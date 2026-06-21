import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

export const contactRouter = Router();

contactRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, message } = req.body;

    // 1. Validation
    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ success: false, message: "Name is required." });
      return;
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ success: false, message: "Valid email is required." });
      return;
    }
    if (!message || typeof message !== "string" || message.trim() === "") {
      res.status(400).json({ success: false, message: "Message is required." });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("Missing RESEND_API_KEY environment variable.");
      res.status(500).json({ success: false, message: "Mail configuration error." });
      return;
    }

    // 2. Email 1: Developer Notification
    const devMailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CognitoX <cognitox@felix-au.me>",
        to: "felixaugum@gmail.com",
        reply_to: email,
        subject: `OmniKey AI: New Inquiry from ${name}`,
        html: `
          <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin: 0; font-size: 20px;">New Contact Form Submission</h2>
              <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">OmniKey AI Workspace Landing Page Inquiry</p>
            </div>
            <div style="margin-bottom: 24px; line-height: 1.5; font-size: 14px;">
              <p style="margin: 0 0 8px 0;"><strong style="color: #475569;">Sender Name:</strong> ${name}</p>
              <p style="margin: 0 0 16px 0;"><strong style="color: #475569;">Sender Email:</strong> <a href="mailto:${email}" style="color: #6366f1; text-decoration: none;">${email}</a></p>
              <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-style: italic; color: #475569; white-space: pre-line;">"${message}"</p>
              </div>
            </div>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">This email was securely routed from the OmniKey AI Workspace contact form. Click "Reply" to respond directly to the sender.</p>
          </div>
        `,
      }),
    });

    const devMailData = (await devMailRes.json()) as any;
    if (!devMailRes.ok) {
      console.error("Developer notification mail failed:", devMailData);
      res.status(devMailRes.status).json({ success: false, message: devMailData.message || "Failed to dispatch email." });
      return;
    }

    // 3. Email 2: User Confirmation Copy
    const userMailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "OmniKey AI Support <cognitox@felix-au.me>",
        to: email,
        subject: "We received your message - OmniKey AI Support",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #111; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #6366f1;">Thank you for contacting us!</h2>
            <p>Hello ${name},</p>
            <p>This is a confirmation copy to let you know that your message has been received. I (Felix Au) will review your request and get back to you as soon as possible.</p>
            <p>Here is a summary of the details you submitted:</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Your Message:</strong></p>
              <p style="margin: 0; font-style: italic; color: #475569;">"${message.replace(/\n/g, "<br/>")}"</p>
            </div>
            <p>Best regards,<br/>The OmniKey AI Team</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">This is an automated confirmation email. Please do not reply directly to this message.</p>
          </div>
        `,
      }),
    });

    const userMailData = (await userMailRes.json()) as any;
    if (!userMailRes.ok) {
      console.warn("User confirmation copy email failed to dispatch:", userMailData);
    }

    res.json({ success: true, message: "Message dispatched successfully." });
  } catch (error: any) {
    console.error("Contact API Exception:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});
