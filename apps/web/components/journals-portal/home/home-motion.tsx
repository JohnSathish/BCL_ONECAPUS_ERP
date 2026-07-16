'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/utils/cn';

type FadeUpProps = HTMLMotionProps<'div'> & {
  delay?: number;
  className?: string;
  children: React.ReactNode;
};

export function FadeUp({ delay = 0, className, children, ...rest }: FadeUpProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
