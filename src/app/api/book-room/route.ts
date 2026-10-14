import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { room_id, room_code, team_name, manager_name, manager_email, manager_phone, idempotency_key } = body;

    if (!room_id || !room_code || !team_name || !idempotency_key) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // 1. REDIS LOCK එක දැමීම (The Magic)
    // 'nx: true' කියන්නේ Lock එකක් නැත්නම් විතරක් දාන්න. 'ex: 30' කියන්නේ තත්පර 30කින් මේ Lock එක ඉබේම අයින් වෙනවා (System එක හිර නොවී තියෙන්න).
    const lockKey = `lock:room:${room_code}`;
    const acquiredLock = await redis.set(lockKey, idempotency_key, { nx: true, ex: 30 });

    if (!acquiredLock) {
      // වෙන කෙනෙක් මේ මිලි තත්පරේ Lock එක අරගෙන තියෙන්නේ
      await logAudit(room_code, team_name, 'LOCK_FAILED', 'Room is currently being booked by someone else.');
      return NextResponse.json({ 
        success: false, 
        message: "Sorry, this room is currently locked as someone else is booking it right now." 
      }, { status: 409 });
    }

    try {
      // Lock එක අපිට ලැබුණා!
      await logAudit(room_code, team_name, 'LOCK_ACQUIRED', 'Redis lock acquired successfully.');

 // 2. Database එකෙන් කාමරේ Status එක සහ Expiry එක බලමු
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('status, held_until')
        .eq('id', room_id)
        .single();

      if (roomError || !room) {
        throw new Error("Room not found.");
      }

      // කාමරය AVAILABLE ද, නැතහොත් HELD වී තිබී විනාඩි 10 කල් ඉකුත් වී ඇත්දැයි බැලීම
      const isExpired = room.status === 'HELD' && room.held_until && new Date(room.held_until) < new Date();
      const isAvailable = room.status === 'AVAILABLE' || isExpired;

      if (!isAvailable) {
        throw new Error("Room is already locked or booked.");
      }

      // 3. කාමරේ 'HELD' විදියට Update කරමු (විනාඩි 10 කින් Auto-Release වෙන්න වෙලාවත් දාමු)
      const heldUntil = new Date(Date.now() + 10 * 60000).toISOString(); // විනාඩි 10යි
      
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: 'HELD', held_until: heldUntil })
        .eq('id', room_id);

      if (updateError) throw updateError;

      // 4. Booking එක 'PENDING' විදියට Database එකට දාමු
      const bookingRef = `GA-${room_code.replace(/\s+/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          booking_ref: bookingRef,
          room_id: room_id,
          team_name: team_name,
          manager_name: manager_name,
          manager_email: manager_email,
          manager_phone: manager_phone,
          idempotency_key: idempotency_key,
          status: 'PENDING'
        }])
        .select()
        .single();

      if (bookingError) {
        // බුකින් එකේ අවුලක් ගියොත් කාමරේ ආයෙත් 'AVAILABLE' කරනවා
        await supabase.from('rooms').update({ status: 'AVAILABLE', held_until: null }).eq('id', room_id);
        throw bookingError;
      }

      await logAudit(room_code, team_name, 'ROOM_HELD', `Room temporarily held for 10 minutes. Booking Ref: ${bookingRef}`);

      // 5. වැඩේ ඉවර වුනාම Redis Lock එක අයින් කරනවා (අනෙක් අයට ඊළඟ කාමර ගන්න)
      await redis.del(lockKey);

      return NextResponse.json({
        success: true,
        message: "Room successfully held for 10 minutes. Please complete payment.",
        booking: booking
      });

    } catch (dbError: any) {
      // මොකක් හරි Database එකේ අවුලක් ගියොත් Lock එක අයින් කරනවා
      await redis.del(lockKey);
      await logAudit(room_code, team_name, 'BOOKING_ERROR', dbError.message);
      
      return NextResponse.json({ success: false, message: dbError.message }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Server Error", error: error.message }, { status: 500 });
  }
}

// Audit Logs දාන පොඩි Function එක
async function logAudit(room_code: string, team_name: string, action: string, message: string) {
  await supabase.from('audit_logs').insert([{
    room_code,
    team_name,
    action,
    message
  }]);
}