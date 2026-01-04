export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Mocking the success response as requested
    return res.status(200).json({
      status: true,
      message: "Order Created Successfully",
      result: {
        orderId: "TEST" + Date.now(),
        payment_url: "https://onkarjha.com/payment/pay.php?data=a62e800f100cba4dd7b24ebeda2cca92" 
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Error creating order"
    });
  }
}
