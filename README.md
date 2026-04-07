# DocBot Pro: Your Personal PDF Intelligence Assistant

DocBot Pro is a sleek, AI-powered document analyzer that lets you "chat" with your PDF files. Using **Google's Gemini Flash 1.5**, it indexes your documents in seconds and provides hyper-accurate, context-grounded answers.

---

## 🚀 Features

- **Full Document Recall**: Analyzes the entire text of storybooks, manuals, or research papers.
- **High-Density Search**: Smart paragraph extraction for extremely large documents.
- **Clean UI**: A professional, dark-mode inspired interface with real-time indicators.
- **Smart Response System**: Handles both general knowledge and document-specific queries.

## 🛠️ Setup & Local Installation

### Prerequisites
- [Node.js](https://nodejs.org/) installed.
- A [Google AI Studio API Key](https://aistudio.google.com/app/apikey).

### 1. Clone the repository
```bash
git clone https://github.com/bgnanavinaidu19/pdf-chatbot.git
cd pdf-chatbot
```

### 2. Configure Backend
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory and add your API key:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Start the Server
```bash
node server.js
```
The backend will run on `http://127.0.0.1:5005`.

### 4. Launch Frontend
Open `frontend/index.html` in any modern web browser.

---

## 🌐 Running Beyond Localhost (Deployment)

Yes, you can run this project in a live environment! Here is how:

### **A. Backend Hosting**
To host the backend (Node.js/Express), use services like:
- **Render.com** or **Railway.app** (Simplest for Node.js).
- **Heroku** or **DigitalOcean App Platform**.

### **B. Frontend Hosting**
To host the static files (HTML/CSS/JS), use:
- **GitHub Pages** (Free).
- **Netlify** or **Vercel**.

### **C. Crucial Configuration Step**
When you deploy the backend, change the API endpoint in `frontend/script.js`:

```javascript
// Change this line (approx. line 182 and 228)
// From:
const response = await fetch("http://127.0.0.1:5005/upload", { ... });

// To your live URL:
const response = await fetch("https://your-backend-app.onrender.com/upload", { ... });
```
