import React from 'react';
import AIStampGenerator from '../components/AIStampGenerator';

export default function AIStampPage({ user, currentUserProgress, onPointsUpdate }) {
  return (
    <AIStampGenerator 
      user={user} 
      currentUserProgress={currentUserProgress} 
      onPointsUpdate={onPointsUpdate} 
    />
  );
} 