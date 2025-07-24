export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
    }
    const { activityList, params } = req.body;
    console.log("Received activityList:", activityList);
    console.log("Received params:", params);

    const summary = activityList.map(activity => {
        return {
            title: activity.title,
            url: activity.url,
            duration: activity.duration,
        };
    }).join('\n');
    res.status(200).json({ summary });
}