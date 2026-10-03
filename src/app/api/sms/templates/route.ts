import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Pre-defined message templates (no database needed — hardcoded for speed)
const TEMPLATES = [
  { id: 'welcome', name: 'Welcome Message', category: 'onboarding', body: 'Hi {name}, welcome to ALO Labs MarketingOS! We are excited to help you grow your business. Reply STOP to opt out.' },
  { id: 'follow_up', name: 'Follow Up', category: 'sales', body: 'Hi {name}, I wanted to follow up on your interest in our services. Would you like to schedule a call this week?' },
  { id: 'promotion', name: 'Promotion', category: 'marketing', body: 'Hi {name}, special offer just for you! Get 20% off on all marketing services this month. Use code: AILO20' },
  { id: 'appointment', name: 'Appointment Reminder', category: 'scheduling', body: 'Hi {name}, this is a reminder for your appointment tomorrow at 10 AM. Reply C to confirm or R to reschedule.' },
  { id: 'thank_you', name: 'Thank You', category: 'follow_up', body: 'Hi {name}, thank you for choosing ALO Labs! We appreciate your business. How was your experience? Reply 1-5.' },
  { id: 'win_back', name: 'Win Back', category: 'retention', body: 'Hi {name}, we miss you! Come back and get 30% off your next month. Your success is our priority.' },
  { id: 'newsletter', name: 'Newsletter Opt-in', category: 'marketing', body: 'Hi {name}, would you like to receive weekly marketing tips and AI insights? Reply YES to subscribe.' },
  { id: 'feedback', name: 'Feedback Request', category: 'support', body: 'Hi {name}, how satisfied are you with our service? Reply with a number 1-5. Your feedback matters.' },
];

// GET /api/sms/templates — list all message templates
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    return NextResponse.json({ data: TEMPLATES });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
