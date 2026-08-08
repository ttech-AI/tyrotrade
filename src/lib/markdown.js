// Copilot Studio bot mesajları sık sık ham HTML etiketleri içerir:
// satır-sonu (<br>, <hr>), paragraf (<p>) ve inline biçimlendirme
// (<b>/<strong>, <i>/<em>). Markdown renderer'larımız ham HTML'i kapalı
// tutuyor (react-markdown rehype-raw yok; markdown-it html:false) — bu yüzden
// etiketler düz METİN olarak görünür. Render'dan önce CommonMark karşılıklarına
// çeviriyoruz: <br> → hard break, <hr> → ---, <p> → paragraf boşluğu,
// <b>/<strong> → **, <i>/<em> → *. Ham HTML enjeksiyonu açmadığı için XSS güvenli.
export function normalizeBotMarkdown(text) {
  if (typeof text !== "string") return text ?? ""
  return text
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    // Paragraf etiketleri (bot bunları çoğu zaman kapatmadan ayraç olarak kullanır)
    .replace(/<\/?p\s*\/?>/gi, "\n\n")
    // Kalın: <b>, <strong> (açma ve kapama ikisi de ** olur)
    .replace(/<\/?(?:b|strong)\s*>/gi, "**")
    // İtalik: <i>, <em>
    .replace(/<\/?(?:i|em)\s*>/gi, "*")
    // Markdown karşılığı olmayan inline etiketleri (altı çizili) at
    .replace(/<\/?u\s*>/gi, "")
    // 3+ ardışık boş satırı tek paragraf boşluğuna indir, baş/son boşlukları kırp
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
