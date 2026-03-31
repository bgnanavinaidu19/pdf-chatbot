async function testChat() {
  const response = await fetch("http://localhost:5001/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "hi" }),
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
testChat();
