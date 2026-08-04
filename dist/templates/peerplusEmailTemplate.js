export const PEERSPLUS_LOGO_URL = 'https://peersplus.com/peers-plus-logo.png';
const PEERSPLUS_NAME = 'PeersPlus';
const PEERSPLUS_SITE_URL = 'https://www.peersplus.com';
export function wrapEmailHtml(subject, bodyHtml) {
    const safeSubject = String(subject || PEERSPLUS_NAME);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #18181b; }
    .container { max-width: 640px; margin: 32px auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(24, 24, 27, 0.08); }
    .header { padding: 24px 32px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-bottom: 1px solid #e4e4e7; }
    .logo { display: block; max-width: 190px; height: auto; }
    .body { padding: 32px; }
    .body h1, .body h2, .body h3 { margin-top: 0; color: #111827; }
    .body p { margin: 0 0 14px; line-height: 1.65; color: #3f3f46; }
    .body a { color: #0f766e; }
    .footer { padding: 22px 32px 28px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #71717a; }
    .footer a { color: #71717a; }
    .preview { display: none; font-size: 1px; color: transparent; }
    @media (max-width: 640px) {
      .container { margin: 0; border-radius: 0; }
      .header, .body, .footer { padding-left: 20px; padding-right: 20px; }
    }
  </style>
</head>
<body>
  <span class="preview">${safeSubject}</span>
  <div class="container">
    <div class="header">
      <a href="${PEERSPLUS_SITE_URL}" target="_blank" rel="noreferrer">
        <img class="logo" src="${PEERSPLUS_LOGO_URL}" alt="PeersPlus" />
      </a>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>Sent by PeersPlus</p>
      <p style="margin-top:4px;">Visit <a href="${PEERSPLUS_SITE_URL}">${PEERSPLUS_SITE_URL}</a></p>
    </div>
  </div>
</body>
</html>`;
}
