export async function photoData(url: string): Promise<{
    image: string;
    palette: string[];
}> { const img = new Image(); img.src = url; await img.decode(); const canvas = document.createElement('canvas'); const scale = Math.min(1, 960 / Math.max(img.width, img.height)); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale); const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const image = canvas.toDataURL('image/jpeg', .78); const c = document.createElement('canvas'); c.width = c.height = 80; const cx = c.getContext('2d')!; cx.drawImage(img, 0, 0, 80, 80); const data = cx.getImageData(0, 0, 80, 80).data; const points: number[][] = []; for (let i = 0; i < data.length; i += 16) {
    const p = [data[i], data[i + 1], data[i + 2]];
    const brightness = p.reduce((s, x) => s + x, 0) / 3;
    if (brightness > 30 && brightness < 242)
        points.push(p);
} if (points.length < 10)
    return { image, palette: ['#dedbd3', '#ae9880', '#575b51', '#342d28'] }; let centers = [.1, .35, .65, .9].map(q => [...points[Math.floor(q * (points.length - 1))]]); for (let k = 0; k < 12; k++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of points) {
        let nearest = 0, dist = Infinity;
        centers.forEach((c, i) => { const d = c.reduce((s, x, j) => s + (x - p[j]) ** 2, 0); if (d < dist) {
            nearest = i;
            dist = d;
        } });
        for (let j = 0; j < 3; j++)
            sums[nearest][j] += p[j];
        sums[nearest][3]++;
    }
    centers = centers.map((c, i) => sums[i][3] ? sums[i].slice(0, 3).map(x => x / sums[i][3]) : c);
} centers.sort((a, b) => b.reduce((s, x) => s + x, 0) - a.reduce((s, x) => s + x, 0)); return { image, palette: centers.map(c => '#' + c.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')) }; }
