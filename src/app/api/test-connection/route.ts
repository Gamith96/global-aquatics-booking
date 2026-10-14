import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    // 1. Redis එක වැඩද කියලා බලමු
    await redis.set('test_key', 'Redis 100% Connected!');
    const redisResult = await redis.get('test_key');

    // 2. Supabase එක වැඩද කියලා බලමු
    const { data: rooms, error } = await supabase.from('rooms').select('room_code').limit(1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "සුපිරි! System දෙකම හරියටම Connect වෙලා තියෙන්නේ.",
      redis_status: redisResult,
      supabase_test: rooms ? "Supabase 100% Connected!" : "No data",
      first_room_found: rooms?.[0]?.room_code
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "කොහේ හරි පොඩි අවුලක් තියෙනවා",
      error: error.message
    }, { status: 500 });
  }
}