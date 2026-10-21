export async function createTrelloCard(title, description) {
  const apiKey = process.env.TRELLO_API_KEY;
  const apiToken = process.env.TRELLO_API_TOKEN;
  const listId = process.env.TRELLO_LIST_ID;
  
  if (!apiKey || !apiToken || !listId) return;

  const url = `https://api.trello.com/1/cards?key=${apiKey}&token=${apiToken}&idList=${listId}&name=${encodeURIComponent(title)}&desc=${encodeURIComponent(description)}`;
  await fetch(url, { method: "POST" });
}
