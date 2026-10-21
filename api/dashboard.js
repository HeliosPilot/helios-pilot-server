import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const configuredToken = process.env.DASHBOARD_TOKEN;
  const providedToken = req.query?.token || req.headers?.['x-dashboard-token'];

  if (configuredToken && providedToken !== configuredToken) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const filePath = path.join(process.cwd(), 'views', 'dashboard.html');
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send('Dashboard unavailable');
  }
}
