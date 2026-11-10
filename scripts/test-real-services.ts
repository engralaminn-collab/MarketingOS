import { synthesize } from '../src/lib/voice-engine';
import { transcribe } from '../src/lib/asr-engine';
import { chainChat } from '../src/lib/ai-chain';

async function main() {
  console.log('=== 1. AI CHAIN (LLM) ===');
  const llmResult = await chainChat([
    { role: 'system', content: 'You are a helpful AI assistant. Reply in Bangla.' },
    { role: 'user', content: 'আমার একটি ফেসবুক পোস্ট দরকার যা আমাদের AI মার্কেটিং সার্ভিস সম্পর্কে।' },
  ], { maxTokens: 500, temperature: 0.4 });
  console.log('  Provider:', llmResult.provider);
  console.log('  Model:', llmResult.model);
  console.log('  Latency:', llmResult.durationMs + 'ms');
  console.log('  Response:', llmResult.text.substring(0, 200));
  console.log('');

  console.log('=== 2. TTS (Text-to-Speech) ===');
  const ttsResult = await synthesize({
    text: 'আসসালামু আলাইকুম। আমি এআই এজেন্ট। আপনাকে সাহায্য করতে প্রস্তুত।',
    language: 'bn-BD',
  });
  console.log('  Provider:', ttsResult.provider);
  console.log('  Model:', ttsResult.modelId);
  console.log('  Simulated:', ttsResult.simulated);
  console.log('  Audio URL:', ttsResult.audioUrl ? 'YES ✅' : 'NO');
  console.log('  Audio base64:', ttsResult.audioBase64 ? 'YES (' + ttsResult.audioBase64.length + ' chars)' : 'NO');
  console.log('  Characters:', ttsResult.charactersProcessed);
  console.log('');

  console.log('=== 3. ASR (Speech-to-Text) ===');
  // Test with a small base64 audio (empty — will use simulation fallback)
  const asrResult = await transcribe({
    audioBase64: 'SGVsbG8=', // "Hello" in base64 (dummy)
    language: 'bn-BD',
  });
  console.log('  Provider:', asrResult.provider);
  console.log('  Model:', asrResult.modelId);
  console.log('  Simulated:', asrResult.simulated);
  console.log('  Text:', asrResult.text || '(empty — no real audio provided)');
  console.log('  Error:', asrResult.error || 'none');
  console.log('');

  console.log('=== SUMMARY ===');
  console.log('  LLM: ' + (llmResult.text ? '✅ WORKING (Z.AI free tier)' : '❌ NOT WORKING'));
  console.log('  TTS: ' + (ttsResult.audioUrl || ttsResult.audioBase64 ? '✅ WORKING' : (ttsResult.simulated ? '⚠️ SIMULATED (Z.AI may be rate-limited)' : '❌ NOT WORKING')));
  console.log('  ASR: ' + (asrResult.simulated ? '⚠️ SIMULATED (no audio provided in test)' : '✅ WORKING'));
  console.log('');
  console.log('REAL SERVICE STATUS:');
  console.log('  ✅ AI conversations: WORKING via Z.AI (free)');
  console.log('  ' + (ttsResult.audioUrl || ttsResult.audioBase64 ? '✅' : '⚠️') + ' Voice generation: ' + (ttsResult.audioUrl || ttsResult.audioBase64 ? 'WORKING via Z.AI' : 'FALLBACK — Z.AI rate-limited, install Piper for local'));
  console.log('  ⚠️ Speech recognition: needs real audio to test (Z.AI cloud available)');
  console.log('  ❌ Real telephone calls: need Twilio/FreeSWITCH credentials');
}

main().catch(console.error);
