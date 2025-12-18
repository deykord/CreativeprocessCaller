# ElevenLabs Integration Guide

## ✅ Implementation Complete

The training system now uses **ElevenLabs** for text-to-speech instead of OpenAI TTS.

## 🎯 What Changed

### Backend Changes
- **Text-to-Speech Provider**: Switched from OpenAI TTS to ElevenLabs API
- **Voice Options**: Updated to use 8 premium ElevenLabs voices
- **API Endpoint**: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- **Model**: Using `eleven_turbo_v2_5` (fast, low-latency model)

### Voice List (ElevenLabs)
| Voice ID | Name | Description | Gender |
|----------|------|-------------|--------|
| `pNInz6obpgDQGcFmaJgB` | Adam | Deep, authoritative male | Male |
| `EXAVITQu4vr4xnSDxMaL` | Bella | Soft, warm female | Female |
| `ErXwobaYiN019PkySvjV` | Antoni | Well-rounded male | Male |
| `MF3mGyEYCl7XYWbV9V6O` | Elli | Young, energetic female | Female |
| `TxGEqnHWrfWFTfGW9XjX` | Josh | Professional male | Male |
| `VR6AewLTigWG4xSOukaG` | Arnold | Crisp, confident male | Male |
| `ThT5KcBeYPX3keUQqHPh` | Dorothy | Pleasant female | Female |
| `pqHfZKP75CvOlQylNhV4` | Bill | Trustworthy male | Male |

### Pricing Update
- **OpenAI TTS**: $15 per 1M characters (~$0.06/min)
- **ElevenLabs**: ~$0.30 per 1K characters (~$0.10/min)
- **Quality**: ElevenLabs provides significantly more natural and realistic voices

## 🔑 Configuration

### 1. Get ElevenLabs API Key

1. Go to [ElevenLabs](https://elevenlabs.io)
2. Sign up or log in
3. Navigate to [API Keys](https://elevenlabs.io/app/settings/api-keys)
4. Click "Create API Key"
5. Copy your new API key

### 2. Configure in Application

#### Option A: Through UI (Recommended)
1. Log in to the application
2. Go to **Training Labs** section
3. Click on the **ElevenLabs** provider tab
4. Paste your API key
5. Click **Test Connection**
6. Click **Save API Key**

#### Option B: Manually in .env file
```bash
# Edit server/.env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

Then restart the server:
```bash
cd /root/CreativeprocessCaller
npm run build
pm2 restart all
```

## 📁 Modified Files

1. **server/controllers/trainingAIController.js**
   - Updated `generateSpeech()` function to use ElevenLabs API
   - Changed voice list to ElevenLabs voices
   - Updated cost tracking

2. **server/controllers/trainingController.js**
   - Added ElevenLabs provider support
   - Updated `testApiKey()` to validate ElevenLabs keys
   - Updated `saveApiKey()` to save ElevenLabs keys
   - Updated `getProviderStatus()` to check both OpenAI and ElevenLabs

3. **components/Training.simplified.tsx**
   - Added provider selection UI (OpenAI / ElevenLabs)
   - Updated configuration interface
   - Added separate status for each provider

4. **components/Training.tsx**
   - Updated default voice to Adam (ElevenLabs)
   - Updated fallback voice list

## 🎤 Voice Settings

The implementation uses these ElevenLabs settings for optimal quality:

```javascript
{
  model_id: 'eleven_turbo_v2_5',  // Fast, low-latency model
  voice_settings: {
    stability: 0.5,              // Balance between consistency and expressiveness
    similarity_boost: 0.75,      // Voice similarity to original
    style: 0.0,                  // Style exaggeration (0 = natural)
    use_speaker_boost: true      // Enhance clarity
  }
}
```

## 🚀 Benefits of ElevenLabs

### Over OpenAI TTS:
- ✅ **More Natural**: Significantly more realistic and human-like voices
- ✅ **Better Expression**: Superior emotional range and intonation
- ✅ **Voice Variety**: 8 distinct, professional voices
- ✅ **Quality**: Industry-leading voice cloning technology
- ✅ **Customization**: Fine-tune stability, similarity, and style

### Use Cases:
- Training simulations with realistic prospect voices
- Professional customer service scenarios
- Sales pitch practice with natural responses
- Cold calling training with authentic reactions

## 🧪 Testing

To test the integration:

1. **Check Configuration**:
   ```bash
   curl -X GET http://localhost:3001/api/training/providers/status \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Test TTS Generation**:
   - Start a training session
   - Select a scenario (e.g., "Cold Call - Interested Prospect")
   - Choose a voice (e.g., "Adam")
   - The AI will respond using ElevenLabs TTS

3. **Verify in Logs**:
   ```bash
   pm2 logs
   # Look for: "🔊 Generating ElevenLabs TTS with voice:"
   ```

## 📊 Cost Tracking

The system automatically tracks usage:
- Character count per TTS request
- Estimated cost per request
- Stored in `training_usage` table with model: `eleven_turbo_v2_5`

## 🔧 Troubleshooting

### "ElevenLabs API key not configured"
- Ensure `ELEVENLABS_API_KEY` is set in `.env`
- Restart the server after adding the key

### "Invalid API key"
- Verify the key is correct (no extra spaces)
- Check your ElevenLabs account has credits
- Test the key using the UI test feature

### "Request failed"
- Check your internet connection
- Verify ElevenLabs API is accessible
- Check API rate limits on your account

### Poor Voice Quality
- Try different voices for your use case
- Adjust `stability` setting (higher = more consistent, lower = more expressive)
- Use `eleven_turbo_v2_5` for speed or `eleven_multilingual_v2` for quality

## 🔄 Reverting to OpenAI

If you want to switch back to OpenAI TTS:

1. Open `server/controllers/trainingAIController.js`
2. In the `generateSpeech()` function, replace the ElevenLabs API call with the OpenAI implementation
3. Update voice IDs back to OpenAI voices (alloy, echo, fable, onyx, nova, shimmer)

## 📚 Additional Resources

- [ElevenLabs Documentation](https://elevenlabs.io/docs)
- [Voice Library](https://elevenlabs.io/voice-library)
- [Pricing](https://elevenlabs.io/pricing)
- [API Reference](https://elevenlabs.io/docs/api-reference)

## ✨ Future Enhancements

Potential improvements:
- [ ] Custom voice cloning for personalized training
- [ ] Voice selection per scenario
- [ ] Multiple languages support
- [ ] Voice emotion control
- [ ] Real-time voice switching during calls
