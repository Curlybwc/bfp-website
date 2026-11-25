// BFP public website — Eleventy scaffold.
// Static build for GitHub Pages. Facts never live here: listing pages read
// Ezzie's anon listing_public_read at request time (Piece 6); the browse set
// rides a publish-time identity manifest (Piece 5). This repo holds chrome,
// design, and page structure only.
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Custom domain (Piece 12): the CNAME file must land in the built site's
  // root so the Pages artifact carries the domain on every deploy.
  eleventyConfig.addPassthroughCopy({ CNAME: "CNAME" });
  eleventyConfig.addFilter("dateYear", () => new Date().getFullYear());

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    // Custom domain pointed 2026-11-25 (Piece 12): the site serves at the
    // root of bahrfamilyproperties.com, so no path prefix.
    pathPrefix: "/",
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
