export async function generateArticles(topic, num, lang) {
  const articles = [];
  for (let i = 0; i < num; i++) {
    articles.push({
      title: `Article ${i + 1} sur ${topic}`,
      content: `Ceci est un article en ${lang} généré par IA sur ${topic}.`,
    });
  }
  return articles;
}
