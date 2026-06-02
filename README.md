# אורקל · Oracle — עוזרת קולית בעברית עם אווטאר עין נוזלי

A production-grade Hebrew voice assistant with a living, audio-reactive
**liquid-eye avatar** rendered in real-time WebGL (inspired by the liquid
sentinel from *Deus*). Speak to it in Hebrew and it answers back in Hebrew —
the liquid body churns and pulses in sync with the voice.

Powered by your **OpenAI API key** (speech-to-text, chat, and text-to-speech),
fully responsive, and tuned to feel great on a phone.

---

## ✨ תכונות / Features

- 🎙️ **שיחה קולית מלאה בעברית** — מקליט אותך, מתמלל (Whisper), עונה (GPT‑4o) ומקריא בקול (TTS).
- 👁️ **אווטאר עין נוזלי תלת־ממדי** — shader פרוצדורלי ב‑WebGL. הנוזל, הטיפות והקשתית נעים בזמן אמת לפי עוצמת הקול בזמן הדיבור.
- 📱 **רספונסיביות מלאה** — מותאם למובייל (RTL, `100dvh`, safe‑area, מבט שעוקב אחרי מגע).
- 🔒 **מאובטח** — מפתח ה‑OpenAI נשאר בשרת בלבד, אף פעם לא נחשף בדפדפן.

## 🏗️ ארכיטקטורה

```
client/   Vite + React + TypeScript + Three.js   (ה‑UI והאווטאר)
server/   Node + Express + openai                (פרוקסי מאובטח ל‑OpenAI)
```

נקודות קצה בשרת:

| Endpoint          | תיאור                                         |
| ----------------- | --------------------------------------------- |
| `POST /api/transcribe` | אודיו → טקסט עברי (Whisper)               |
| `POST /api/chat`       | היסטוריית שיחה → תשובה בעברית (GPT‑4o)    |
| `POST /api/tts`        | טקסט → דיבור בעברית (mp3)                 |

## 🚀 הפעלה / Getting started

דרישות: **Node 20+**.

```bash
# 1. התקנת תלויות (root + client + server)
npm install

# 2. הגדרת מפתח OpenAI
cp server/.env.example server/.env
#   ערוך את server/.env והדבק את המפתח שלך:
#   OPENAI_API_KEY=sk-...

# 3. הרצה במצב פיתוח (שרת + לקוח יחד)
npm run dev
```

- לקוח: <http://localhost:5173>
- שרת: <http://localhost:8787>

### 📱 בדיקה בטלפון

ה‑dev server חשוף ברשת המקומית (`host: true`). פתח בטלפון את
`http://<כתובת-ה-IP-של-המחשב>:5173` כשהוא מחובר לאותו Wi‑Fi.

> ⚠️ הקלטת מיקרופון דורשת הקשר מאובטח. ב‑`localhost` זה עובד; בכתובת IP
> ייתכן שתצטרך HTTPS. הדרך הקלה לבדיקה אמיתית בטלפון היא לפרוס (ראה למטה),
> או להריץ מנהור HTTPS (למשל `ngrok http 5173`).

## 🏭 בנייה והרצה לפרודקשן

```bash
npm run build      # בונה את הלקוח אל client/dist
npm start          # השרת מגיש את הלקוח הבנוי + ה‑API מאותו פורט
```

לאחר מכן פתח את `http://localhost:8787`.

### 🚂 פריסה ל‑Railway (מומלץ — עובד גם מהטלפון)

הפרויקט כבר מוכן ל‑Railway כשירות יחיד (`railway.json` + `nixpacks.toml`):

1. העלה את הקוד ל‑GitHub (ראה למטה).
2. ב‑[railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** ובחר את ה‑repo.
3. ב‑**Variables** הוסף משתנה סביבה:
   - `OPENAI_API_KEY` = המפתח שלך (`sk-...`)
   - `NODE_ENV` = `production`
4. Railway מזהה אוטומטית את ה‑Build (`npm install && npm run build`) וה‑Start (`npm start`),
   ומזריק `PORT` לבד — השרת כבר קורא ממנו.
5. ב‑**Settings → Networking → Generate Domain** קבל כתובת ציבורית (HTTPS).
   פתח אותה בטלפון — המיקרופון יעבוד כי זה HTTPS. ✅

> אין צורך להגדיר `CORS_ORIGIN`: השרת מגיש גם את הלקוח וגם את ה‑API מאותו דומיין.

#### העלאה ל‑GitHub (פעם אחת)

```bash
git init
git add .
git commit -m "Oracle Hebrew voice avatar"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

> 🔒 קובץ `server/.env` מוגדר ב‑`.gitignore` ולא יעלה ל‑GitHub — המפתח נשאר אצלך בלבד.

### פריסה כללית (Render / VM)

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: הגדר `OPENAI_API_KEY` (ושאר המשתנים לפי הצורך), `NODE_ENV=production`.

## ⚙️ הגדרות (server/.env)

| משתנה                     | ברירת מחדל          | תיאור                       |
| ------------------------- | ------------------- | --------------------------- |
| `OPENAI_API_KEY`          | —                   | **חובה.** מפתח ה‑API שלך.            |
| `OPENAI_CHAT_MODEL`       | `gpt-4o`            | מודל השיחה.                         |
| `OPENAI_TTS_MODEL`        | `gpt-4o-mini-tts`   | מודל ההקראה.                        |
| `OPENAI_TTS_VOICE`        | `onyx`              | קול גברי עמוק (גם `ash` מומלץ).      |
| `OPENAI_TTS_INSTRUCTIONS` | (אווטאר חייזרי-רובוטי) | סגנון הדיבור של הקול.             |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-transcribe` | תמלול עברית מדויק (טוב מ‑whisper‑1). |
| `PORT`                    | `8787`              | פורט השרת.                          |
| `CORS_ORIGIN`             | —                   | origins מותרים בפרודקשן.            |

## 🎛️ איך זה עובד

1. לחיצה על הכפתור מתחילה הקלטה (`MediaRecorder`). המיקרופון מוזרם ל‑`AnalyserNode`
   כדי שהעין תגיב כבר בזמן ההקשבה.
2. לחיצה נוספת עוצרת, שולחת את האודיו ל‑`/api/transcribe`, ואז את ההיסטוריה ל‑`/api/chat`.
3. התשובה מומרת לדיבור ב‑`/api/tts`, מנוגנת דרך אותו `AnalyserNode` — וה‑shader
   של העין מונע מעוצמת הקול (`uAudio`), כך שהנוזל "מדבר".

## 🧰 מבנה קוד עיקרי

- `client/src/avatar/shaders.ts` — ה‑GLSL של העין הנוזלית (לב הוויזואל).
- `client/src/avatar/EyeAvatar.tsx` — ה‑renderer של Three.js.
- `client/src/lib/audio.ts` — הקלטה, ניגון וניתוח עוצמת קול.
- `client/src/hooks/useConversation.ts` — מכונת המצבים של השיחה.
- `server/src/routes.js` — נקודות הקצה ל‑OpenAI.
- `server/src/prompt.js` — האישיות של אורקל.

## 📄 רישיון

MIT.
