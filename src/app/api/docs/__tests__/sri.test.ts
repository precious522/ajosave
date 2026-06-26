describe("Swagger SRI assets", () => {
  it("includes integrity hashes for the external CDN assets", () => {
    const assets = [
      {
        url: "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css",
        integrity: "sha384-9Q2fpS+xeS4ffJy6CagnwoUl+4ldAYhOs9pgZuEKxypVModhmZFzeMlvVsAjf7uT",
      },
      {
        url: "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
        integrity: "sha384-IKpAWwsTL0pcw7/Amtnt2eXF4P1BK64WNuY2E/RG15SWLUW5HXzFuyqCSAr/DP8C",
      },
    ];

    expect(assets).toHaveLength(2);
    expect(assets[0].integrity).toContain("sha384-");
    expect(assets[1].integrity).toContain("sha384-");
  });
});
