import { motion as Motion } from 'framer-motion';

export default function GlassCard({ children, className = '', ...props }) {
  return (
    <Motion.div
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      {...props}
    >
      {children}
    </Motion.div>
  );
}
