/**
 * Send trip completion notification via WhatsApp fallback (wa.me links).
 * For Twilio integration, call from a backend/cloud function to keep credentials secure.
 */
export const buildWaMessage = ({ userName, distanceKm, durationMin, mapLink }) =>
  encodeURIComponent(
    `✅ Trip completed!\n👤 User: ${userName}\n📏 Distance: ${distanceKm} km\n⏱ Duration: ${durationMin} min\n🗺 Map: ${mapLink}`
  );

export const sendWhatsAppFallback = (numbers, msgData) => {
  const text = buildWaMessage(msgData);
  numbers.forEach((num) => {
    const clean = num.replace(/\D/g, '');
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
  });
};
