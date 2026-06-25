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
        from: "OmniKey AI <omnikeyai@felix-au.me>",
        to: "felixaugum@gmail.com",
        reply_to: email,
        subject: `OmniKey AI: New Inquiry from ${name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
            <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
              <h2 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700; tracking: -0.025em;">New Inquiry Received</h2>
              <p style="color: #6b7280; margin: 6px 0 0 0; font-size: 14px;">OmniKey AI - Developer Portal</p>
            </div>
            <div style="margin-bottom: 28px; line-height: 1.6; font-size: 15px;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #4b5563;">Sender:</strong> ${name}</p>
              <p style="margin: 0 0 20px 0;"><strong style="color: #4b5563;">Email:</strong> <a href="mailto:${email}" style="color: #7c3aed; text-decoration: none; font-weight: 500;">${email}</a></p>
              <div style="background-color: #f9fafb; border-left: 4px solid #7c3aed; padding: 20px; border-radius: 8px;">
                <p style="margin: 0; font-style: italic; color: #374151; white-space: pre-line;">"${message}"</p>
              </div>
            </div>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 28px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0; line-height: 1.5;">This email was securely routed from the OmniKey AI contact form.<br/>Click "Reply" to respond directly to the sender.</p>
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
        from: "OmniKey AI Support <omnikeyai@felix-au.me>",
        to: email,
        subject: "We received your message - OmniKey AI Support",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">We've received your message</h2>
              <p style="color: #6b7280; margin: 6px 0 0 0; font-size: 14px;">OmniKey AI Support Team</p>
            </div>
            <div style="line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
              <p>Hello ${name},</p>
              <p>Thank you for reaching out to us. This is an automated confirmation to let you know we've received your request.</p>
              <p>Our developer (Felix Au) will review your query and get back to you shortly.</p>
              <div style="margin-top: 24px; background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 20px; border-radius: 12px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.05em;">Your Message Preview</p>
                <p style="margin: 0; font-style: italic; color: #374151; white-space: pre-line;">"${message}"</p>
              </div>
            </div>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">This is an automated copy for your records. Please do not reply directly to this email.</p>
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
