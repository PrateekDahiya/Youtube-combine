async function sendEmail({ to, subject, text }) {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to,
            subject,
            text,
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error ${response.status}: ${body}`);
    }
    return response.json();
}

module.exports = { sendEmail };