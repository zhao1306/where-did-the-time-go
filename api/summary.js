export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
    }
    const { activityList, params } = req.body;
    console.log("Received activityList:", activityList);
    console.log("Received params:", params);

    const summary = `activityList: ${activityList}, params: ${params}`;
    res.status(200).json({ summary });
}