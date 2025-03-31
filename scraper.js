// scraper.js
const puppeteer = require("puppeteer");

async function scrapeDirectorPagePuppeteer() {
  const url = "https://vdo.ninja/?director=EXTIA_GAMING_NIGHT2";

  let browser;
  try {
    console.log("[Scraper] Lancement de Puppeteer en mode headless...");

    browser = await puppeteer.launch({
      headless: true, // <-- Mode headless (invisible)
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    console.log(`[Scraper] Navigation vers: ${url}`);

    // Attente jusqu'au "networkidle2" pour un chargement poussé
    await page.goto(url, { waitUntil: "networkidle2" });

    console.log("[Scraper] Page chargée, j'attends 5 secondes...");

    // Attendre 5s manuellement, compatible avec toutes versions de Puppeteer
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("[Scraper] Récupération des data-sid...");

    // Extraire tous les attributs data-sid
    const sids = await page.evaluate(() => {
      console.log(
        "DOM -> Nombre d'éléments .vidcon.directorMargins :",
        document.querySelectorAll("#guestFeeds .vidcon.directorMargins").length
      );
      return Array.from(
        document.querySelectorAll("#guestFeeds .vidcon.directorMargins")
      ).map((el) => el.getAttribute("data-sid") || "");
    });

    console.log("[Scraper] data-sid trouvés :", sids);

    await browser.close();
    console.log("[Scraper] Navigateur (invisible) fermé. Terminé.");

    return { success: true, sids };
  } catch (err) {
    console.error("[Scraper] Erreur :", err.message);
    if (browser) await browser.close();
    return { success: false, error: err.message, sids: [] };
  }
}

module.exports = { scrapeDirectorPagePuppeteer };
