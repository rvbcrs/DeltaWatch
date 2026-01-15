
import { Monitor } from './types';

const COLORS = {
  bg: '#0d1117',
  cardBg: '#161b22',
  headerBg: '#21262d',
  border: '#30363d',
  text: '#c9d1d9',
  textMuted: '#8b949e',
  link: '#58a6ff',
  success: '#238636',
  danger: '#da3633', 
  dangerText: '#f85149',
  successText: '#3fb950',
  title: '#ffffff',
  aiBorder: '#6e40c9',
  aiBg: '#120d21',
  aiText: '#d2a8ff'
};

const FONT_FAMILY = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function getBaseLayout(title: string, content: string, username?: string): string {
  const greeting = username ? `<p style="margin-bottom: 20px; font-size: 16px;">Hi ${username},</p>` : '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
    body { font-family: ${FONT_FAMILY}; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bg}; color: ${COLORS.text}; font-family: ${FONT_FAMILY}; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px;">
    
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${COLORS.success}; margin: 0; font-weight: 700; font-size: 24px; letter-spacing: -0.5px;">DeltaWatch</h1>
    </div>

    <div style="background-color: ${COLORS.bg}; border-radius: 12px;">
        <h2 style="color: ${COLORS.title}; padding-bottom: 15px; border-bottom: 1px solid ${COLORS.border}; margin-top: 0; font-weight: 600;">${title}</h2>
        
        ${greeting}

        <div style="line-height: 1.6;">
            ${content}
        </div>

        <div style="margin-top: 40px; border-top: 1px solid ${COLORS.border}; padding-top: 20px; text-align: center; color: ${COLORS.textMuted}; font-size: 12px;">
            <p style="margin: 5px 0;">Sent by <strong>DeltaWatch</strong> agentic monitoring</p>
        </div>
    </div>
  </div>
</body>
</html>
  `;
}

export function getAiSummaryHtml(aiSummary: string): string {
    return `
        <div style="border: 1px solid ${COLORS.aiBorder}; border-radius: 8px; padding: 16px; margin: 16px 0; background-color: ${COLORS.aiBg}; color: ${COLORS.aiText};">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 1.1em; display: flex; align-items: center; color: ${COLORS.aiText};">
                <span style="font-size: 1.4em; margin-right: 8px;">🤖</span> AI Summary
            </div>
            <div style="line-height: 1.6;">${aiSummary.replace(/\n/g, '<br>')}</div>
        </div>
    `;
}

export function getTestEmailHtml(username?: string): string {
    const content = `
        <p style="margin: 15px 0;">This is an <strong>HTML</strong> test notification from <a href="#" style="color: ${COLORS.link}; text-decoration: none;">DeltaWatch</a>.</p>
        <p>If you see the <strong>Space Grotesk</strong> font and dark theme, the email templates are working correctly!</p>
    `;
    return getBaseLayout('Test Notification', content, username);
}

export function getKeywordAlertHtml(monitor: Monitor, alertMessage: string, username?: string): string {
    const content = `
        <p style="margin: 15px 0;"><strong>Monitor:</strong> ${monitor.name || 'Unnamed'}</p>
        <p style="margin: 15px 0;"><strong>URL:</strong> <a href="${monitor.url}" style="color: ${COLORS.link}; text-decoration: none;">${monitor.url}</a></p>
        <div style="background-color: rgba(248, 81, 73, 0.1); border: 1px solid ${COLORS.danger}; border-radius: 6px; padding: 15px; margin: 20px 0; color: ${COLORS.dangerText};">
            <strong>Alert:</strong> ${alertMessage}
        </div>
    `;
    return getBaseLayout('🔑 Keyword Alert', content, username);
}

export function getDowntimeAlertHtml(monitor: Monitor, httpStatus: number | string, username?: string): string {
    const content = `
        <p style="margin: 15px 0;"><strong>Monitor:</strong> ${monitor.name || 'Unnamed'}</p>
        <p style="margin: 15px 0;"><strong>URL:</strong> <a href="${monitor.url}" style="color: ${COLORS.link}; text-decoration: none;">${monitor.url}</a></p>
        <p style="margin: 15px 0;"><strong>HTTP Status:</strong> <span style="color: ${COLORS.dangerText}; font-weight: bold; font-size: 1.2em;">${httpStatus}</span></p>
        <p>The monitor is currently down or unreachable.</p>
    `;
    return getBaseLayout('🔴 Downtime Alert', content, username);
}

export function getNotificationHtml(monitor: Monitor, changeMsg: string, diffHtml: string | null, aiSummaryHtml: string | null, username?: string): string {
    let content = `
        <p style="margin: 15px 0;"><strong>URL:</strong> <a href="${monitor.url}" style="color: ${COLORS.link}; text-decoration: none;">${monitor.url}</a></p>
        
        ${aiSummaryHtml || ''}
        
        <p style="color: ${COLORS.textMuted}; margin: 15px 0;"><strong>Detection:</strong> ${changeMsg}</p>
    `;

    if (diffHtml) {
        content += `
            <h3 style="margin-top: 25px; color: ${COLORS.title}; font-size: 16px;">Text Changes:</h3>
            ${diffHtml}
        `;
    }
    
    return getBaseLayout(`DW: ${monitor.name || 'Monitor Change'}`, content, username);
}

export function getDigestHtml(notifications: any[], username?: string): string {
    let content = `<p style="font-size: 16px; color: ${COLORS.text}; margin-bottom: 25px;">Here are your updates for today:</p>`;

    notifications.forEach(row => {
        content += `
            <div style="margin-bottom: 25px; background: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 8px; overflow: hidden;">
                <div style="background: ${COLORS.headerBg}; padding: 10px 15px; border-bottom: 1px solid ${COLORS.border}; font-weight: bold; color: #e6edf3; display: flex; justify-content: space-between; align-items: center;">
                    <span>${row.subject}</span>
                    <span style="font-weight: normal; font-size: 12px; color: ${COLORS.textMuted};">${new Date(row.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div style="padding: 15px; color: ${COLORS.text}; font-size: 14px; line-height: 1.5;">
                    ${row.html_message || row.message.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
    });

    return getBaseLayout(`DeltaWatch Digest`, content, username);
}
