export async function sendWhatsAppMessage(to: string, message: string) {
  try {
    let formattedTo = to.replace(/\D/g, "");
    if (formattedTo.length === 10) {
      formattedTo = "91" + formattedTo;
    }
    if (!formattedTo) {
      return { success: false, error: "Invalid phone number" };
    }

    // 1. Try microservice if WHATSAPP_SERVICE_URL is set
    const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
    if (serviceUrl) {
      try {
        const response = await fetch(`${serviceUrl}/send-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: formattedTo, message }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          console.log(`WhatsApp message sent via microservice to ${formattedTo}`);
          return { success: true, data };
        }
        console.warn("WhatsApp Microservice response:", data);
      } catch (microErr) {
        console.warn("WhatsApp Microservice connection error:", microErr);
      }
    }

    // 2. Try Meta WhatsApp Cloud API if credentials exist
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (token && phoneId) {
      const payload = {
        messaging_product: "whatsapp",
        to: formattedTo,
        type: "text",
        text: {
          preview_url: true,
          body: message,
        },
      };

      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`WhatsApp text message sent to ${formattedTo}`);
        return { success: true, data };
      }
      console.warn("WhatsApp Meta API error:", data);
      return { success: false, error: data };
    }

    console.log(`[WhatsApp simulated/queued to ${formattedTo}]: ${message.slice(0, 80)}...`);
    return { success: true, simulated: true };
  } catch (error) {
    console.error(`Failed to send WhatsApp message to ${to}:`, error);
    return { success: false, error };
  }
}

// Keeping template function signature for backward compatibility
export async function sendWhatsAppTemplateMessage_Microservice(
  to: string,
  templateName: string,
  parameters: { type: "text"; text: string }[]
) {
  let rawMessage = `New Notification (Template: ${templateName})\n\n`;
  parameters.forEach((param) => {
    rawMessage += `- ${param.text}\n`;
  });

  if (templateName === "new_enquiry" && parameters.length >= 3) {
    rawMessage = `🔔 *New Enquiry Received!*\n\n*Name:* ${parameters[0].text}\n*Contact:* ${parameters[1].text}\n*Institute:* ${parameters[2].text}`;
  }

  return sendWhatsAppMessage(to, rawMessage);
}


// ORIGINAL META API CODE
export async function sendWhatsAppTemplateMessage(
  to: string,
  templateName: string,
  parameters: { type: "text"; text: string }[]
) {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
      console.warn("WhatsApp API credentials are not set.");
      return { success: false, error: "Missing WhatsApp credentials" };
    }

    // Ensure 'to' has country code without '+' or '00', assuming Indian (+91) if 10 digits
    let formattedTo = to.replace(/\D/g, "");
    if (formattedTo.length === 10) {
      formattedTo = "91" + formattedTo;
    }

    const payload = {
      messaging_product: "whatsapp",
      to: formattedTo,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en",
        },
        components: [
          {
            type: "body",
            parameters: parameters,
          },
        ],
      },
    };

    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      return { success: false, error: data };
    }

    console.log(`WhatsApp Template '${templateName}' sent to ${formattedTo}`);
    return { success: true, data };
  } catch (error) {
    console.error(`Failed to send WhatsApp Template message to ${to}:`, error);
    return { success: false, error };
  }
}
