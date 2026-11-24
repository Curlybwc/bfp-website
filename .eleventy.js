// BFP public website — Eleventy scaffold.
// Static build for GitHub Pages. Facts never live here: listing pages read
// Ezzie's anon listing_public_read at request time (Piece 6); the browse set
// rides a publish-time identity manifest (Piece 5). This repo holds chrome,
// design, and page structure only.
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addFilter("dateYear", () => new Date().getFullYear());

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    // GitHub Pages project address (curlybwc.github.io/bfp-website/).
    // When the custom domain is pointed (Piece 12), this becomes "/".
    pathPrefix: "/bfp-website/",
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
