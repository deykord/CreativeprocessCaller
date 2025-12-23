# Audio Troubleshooting Guide

If you're not hearing audio during calls in Manual Dialer or Power Dialer, follow these steps:

## 1. Check Browser Permissions

### Chrome/Brave:
1. Click the padlock icon in address bar
2. Look for "Microphone" and "Camera" permissions
3. If blocked, click "Allow" or "Reset"
4. Refresh the page

### Firefox:
1. Click address bar
2. Look for microphone/camera icons
3. Click to allow permissions
4. Refresh page

### Safari:
1. Settings > Websites > Microphone
2. Make sure salescallagent.my is set to "Allow"
3. Refresh page

## 2. Check System Audio Settings

**Windows:**
- Settings > Sound > Volume mixer
- Make sure browser's microphone is not muted
- Check if speaker volume is at least 50%

**Mac:**
- System Preferences > Sound > Output
- Select correct speakers (not "Internal Microphone")
- Volume at least 50%

**Linux:**
- Check PulseAudio settings
- Ensure audio device is not muted

## 3. Test Audio Devices

1. **Open DevTools** (`F12` or `Ctrl+Shift+I`)
2. **Go to Console tab**
3. **Paste this command:**

```javascript
navigator.mediaDevices.enumerateDevices().then(devices => {
  console.log('📱 Available Audio Devices:');
  devices.forEach(device => {
    if (device.kind === 'audioinput' || device.kind === 'audiooutput') {
      console.log(`${device.kind}: ${device.label} (${device.deviceId})`);
    }
  });
});
```

**What you should see:**
- At least one `audioinput` (microphone) device
- At least one `audiooutput` (speaker) device

If you see nothing or errors → Audio devices not detected

## 4. Check Telnyx Connection

In DevTools Console, look for these logs when making a call:

✓ **Good signs:**
```
✓ Telnyx WebRTC client initialized
🔊 Remote audio is playing
📞 Call update - state: active
```

✗ **Bad signs:**
```
Failed to initialize Telnyx client
Telnyx client not ready
Audio element error
```

## 5. Common Issues & Fixes

### Issue: "Permission Denied"
**Solution:** 
- Check browser permissions (see step 1)
- Try a different browser
- Restart browser completely
- Clear browser cache: Settings > Privacy > Clear browsing data

### Issue: Microphone/Speaker Not Detected
**Solution:**
- Check system audio settings (see step 2)
- Try different USB headset or speakers
- Update audio drivers (Windows)
- Restart computer

### Issue: Silent During Call (But states show "Connected")
**Solution:**
1. Check browser volume mixer (don't mute tab)
2. Speaker volume at 100%
3. Try turning speaker OFF/ON in settings
4. Refresh page and try again

### Issue: No Notification Pop-up for Permissions
**Solution:**
- Browser may have auto-denied
- Clear site data: Settings > Privacy > "Manage Exceptions"
- Delete salescallagent.my from the list
- Go back to app - permission should ask again

## 6. Advanced Debugging

Add this to browser console to enable detailed logging:

```javascript
// Check if Telnyx is initialized
console.log('Audio element exists:', !!document.getElementById('telnyx-remote-audio'));

// Check audio context
if (window.AudioContext || window.webkitAudioContext) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  console.log('AudioContext state:', ctx.state);
}
```

## 7. Contact Support

If none of the above works, provide:
1. Browser name and version (Chrome, Firefox, Safari, Edge?)
2. Operating system (Windows, Mac, Linux?)
3. Screenshot of error in DevTools Console
4. What you see in the logs from step 4

---

## Quick Checklist Before Calling

- [ ] Microphone/speaker connected and working
- [ ] Browser tab NOT muted (check audio icon in tab)
- [ ] System volume at 50%+ 
- [ ] Telnyx shows "ready" in console
- [ ] Permission notification appeared and was allowed
- [ ] Refresh page after changing audio devices
