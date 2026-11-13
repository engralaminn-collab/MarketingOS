'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { UserCircle } from 'lucide-react';
import { LiveTalkStudio } from '@/components/studio/live-talk-studio';

/**
 * Dedicated entry point for the talking-video agent.
 *
 * The studio itself lives in `src/components/studio/live-talk-studio.tsx` so it
 * can also be embedded inside the Media Studio video tab; this view only adds
 * the page header and the scope statement an operator needs before using it.
 */
export function TalkingHeadView() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-sky-500 shadow-lg shadow-orange-500/20">
          <UserCircle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Talk Studio</h1>
          <p className="text-muted-foreground text-sm">
            A photo plus a script becomes a talking clip: live preview in the browser, downloadable WebM, or a job on your own
            lip-sync GPU.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <LiveTalkStudio />
      </motion.div>
    </div>
  );
}

export default TalkingHeadView;
