<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>XML Sitemap — MarTech Discovery Platform</title>
        <style>
          :root{color-scheme:light;--ink:#172b4d;--muted:#60748b;--line:#d8e5f2;--blue:#2563eb;--pale:#f2f8ff;--green:#10a878}
          *{box-sizing:border-box}body{margin:0;background:var(--pale);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
          header{padding:34px 22px 26px;background:linear-gradient(120deg,#fff,#eaf6ff);border-bottom:1px solid var(--line)}
          .wrap{width:min(1120px,100% - 36px);margin:auto}.brand{display:flex;align-items:center;gap:12px;color:var(--ink);text-decoration:none;font-size:13px;letter-spacing:.1em;font-weight:700}
          .mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid #c9ddf5;border-radius:11px;color:var(--blue);font-weight:800;letter-spacing:0;background:white}
          h1{font-size:clamp(27px,5vw,42px);letter-spacing:-.04em;line-height:1.15;margin:28px 0 8px}.intro{margin:0;color:var(--muted);max-width:740px}
          .summary{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:19px}.pill{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:13px}.dot{width:8px;height:8px;border-radius:50%;background:var(--green)}
          main{padding:27px 0 54px}.table-shell{overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 28px rgba(27,61,105,.06)}
          table{width:100%;border-collapse:collapse}thead{background:#f4f8fd}th{padding:13px 17px;text-align:left;color:#52677f;font-size:12px;letter-spacing:.07em;text-transform:uppercase;border-bottom:1px solid var(--line)}td{padding:12px 17px;border-bottom:1px solid #edf2f8;vertical-align:top}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#f7fbff}
          .num{width:62px;color:#8a9bb0;font-size:13px}.url{display:block;color:var(--blue);text-decoration:none;overflow-wrap:anywhere}.url:hover{text-decoration:underline}.path{display:block;color:var(--muted);font-size:13px;margin-top:2px;overflow-wrap:anywhere}.kind{white-space:nowrap;color:var(--muted);font-size:13px}.lang{font-size:12px;color:#52677f;white-space:nowrap}
          footer{padding:19px 0;color:var(--muted);font-size:13px}.footer-row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.footer-row a{color:var(--blue)}
          @media(max-width:640px){header{padding-top:25px}main{padding-top:17px}.wrap{width:min(100% - 24px,1120px)}th,td{padding:10px}.kind{white-space:normal}.num{width:40px}.hide-mobile{display:none}table{font-size:14px}}
        </style>
      </head>
      <body>
        <header>
          <div class="wrap">
            <a class="brand" href="https://martech-discovery-platform.pages.dev/th/">
              <span class="mark">MD</span><span>MARTECH<br />DISCOVERY</span>
            </a>
            <h1>XML Sitemap</h1>
            <p class="intro">A human-readable index of public pages on the MarTech Discovery Platform. Search engines can continue to read this file as standard XML.</p>
            <div class="summary"><span class="pill"><span class="dot"></span> Sitemap is available</span><span class="pill"><xsl:value-of select="count(sm:urlset/sm:url)" /> URLs</span></div>
          </div>
        </header>
        <main class="wrap">
          <div class="table-shell">
            <table>
              <thead><tr><th class="num">#</th><th>Page URL</th><th class="hide-mobile">Section</th><th>Language</th></tr></thead>
              <tbody>
                <xsl:for-each select="sm:urlset/sm:url">
                  <xsl:sort select="sm:loc" />
                  <xsl:variable name="url" select="sm:loc" />
                  <xsl:variable name="path" select="substring-after(sm:loc,'://')" />
                  <tr>
                    <td class="num"><xsl:value-of select="position()" /></td>
                    <td><a class="url" href="{$url}"><xsl:value-of select="$url" /></a><span class="path"><xsl:value-of select="$path" /></span></td>
                    <td class="kind hide-mobile">
                      <xsl:choose>
                        <xsl:when test="contains(sm:loc,'/providers/')">Provider profile</xsl:when>
                        <xsl:when test="contains(sm:loc,'/categories/')">Category</xsl:when>
                        <xsl:when test="contains(sm:loc,'/buyer-guide/')">Buyer Guide</xsl:when>
                        <xsl:when test="contains(sm:loc,'/tools/')">Explore tools</xsl:when>
                        <xsl:when test="contains(sm:loc,'/for-buyers/')">For buyers</xsl:when>
                        <xsl:when test="contains(sm:loc,'/for-providers/')">For providers</xsl:when>
                        <xsl:when test="contains(sm:loc,'/editorial-policy/')">Editorial policy</xsl:when>
                        <xsl:otherwise>Home</xsl:otherwise>
                      </xsl:choose>
                    </td>
                    <td class="lang"><xsl:choose><xsl:when test="contains(sm:loc,'/th/')">ไทย · TH</xsl:when><xsl:when test="contains(sm:loc,'/en/')">English · EN</xsl:when><xsl:otherwise>Default</xsl:otherwise></xsl:choose></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>
          <footer><div class="footer-row"><span>Generated from the platform’s public route registry.</span><span>Machine-readable version: <a href="/sitemap.xml">sitemap.xml</a></span></div></footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
