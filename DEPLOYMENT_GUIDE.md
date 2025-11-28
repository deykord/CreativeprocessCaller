
# 🚀 Creativeprocess.io Deployment Guide

You now have a complete Full-Stack Dialer. Follow these steps to get it running on your server.

---

## Part 1: Backend Setup (Node.js)

1.  **Move the Server Code**
    Copy the `server/` folder from this project to your hosting environment (e.g., AWS EC2, DigitalOcean, Heroku, or your local machine).

2.  **Install Dependencies**
    Open a terminal in the `server/` folder and run:
    ```bash
    cd server
    npm install
    ```

3.  **Configure Environment Variables**
    Create a file named `.env` in the `server/` folder. Copy the contents of `.env.example` into it and fill in your real keys:
    ```env
    PORT=3001
    NODE_ENV=production
    CLIENT_URL=http://localhost:5173  # URL where your frontend is running

    # Get these from https://console.twilio.com
    TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TWILIO_CALLER_ID=+15550000000  # A number you purchased on Twilio
    ```

4.  **Start the Server**
    ```bash
    npm start
    ```
    Your backend is now running at `http://localhost:3001`.

---

## Part 2: Twilio Configuration (Crucial)

To make calls, Twilio needs to know where your backend is.

1.  **Buy a Number**
    - Go to [Twilio Console > Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/active).
    - Buy a Voice-capable number.

2.  **Create TwiML App**
    - Go to **Voice > TwiML > TwiML Apps**.
    - Click **Create New TwiML App**.
    - **Name**: "Creativeprocess Dialer"
    - **Voice Request URL**: `https://your-backend-url.com/api/voice`
      - *Note: If running locally, use [ngrok](https://ngrok.com) to expose your localhost: `ngrok http 3001` -> `https://xyz.ngrok.io/api/voice`.*
    - Click **Save**.
    - Copy the **Sid** (starts with `AP...`) and paste it into your server's `.env` file as `TWILIO_TWIML_APP_SID`.

---

## Part 3: Frontend Connection

1.  **Install Real SDK**
    In your frontend project root, install the Twilio Voice SDK:
    ```bash
    npm install @twilio/voice-sdk
    ```

2.  **Enable Backend Mode**
    Open `App.tsx` and change the configuration constant at the top:
    ```typescript
    const USE_BACKEND = true; // Change this from false to true
    ```

3.  **Run Frontend**
    ```bash
    npm run dev
    ```

---

## Troubleshooting

-   **Microphone Error:** Ensure your browser is allowing microphone access. The site must be served over **HTTPS** (or localhost) for WebRTC to work.
-   **"Twilio Device Error"**: Check your server console. If you see "Signature validation failed", check your `TWILIO_AUTH_TOKEN`.
-   **Calls drop immediately**: Check the Twilio Console Debugger. It usually means the **Voice Request URL** in your TwiML App is unreachable or returning an error.
