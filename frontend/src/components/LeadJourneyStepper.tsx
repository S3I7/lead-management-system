import React from 'react';
import { 
  FileText, Mail, Bell, Upload, ShieldCheck, 
  UserCheck, Award, CreditCard, Sparkles, BookOpen, Check 
} from 'lucide-react';

interface JourneyStepperProps {
  currentStatus: string;
  hasSubmission?: boolean;
  plagiarismChecked?: boolean;
  isEligible?: boolean;
  isPaid?: boolean;
  isPublished?: boolean;
}

interface StepItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const STEPS: StepItem[] = [
  { id: 'INTEREST_FORM', label: 'Interest Form', icon: FileText },
  { id: 'LEAD_CREATED', label: 'Lead Created', icon: Sparkles },
  { id: 'CONFIRMATION_EMAIL', label: 'Confirmation Email', icon: Mail },
  { id: 'REMINDERS', label: 'Reminders', icon: Bell },
  { id: 'STORY_SUBMITTED', label: 'Story Submitted', icon: Upload },
  { id: 'PLAGIARISM_CHECK', label: 'Manual Plagiarism', icon: ShieldCheck },
  { id: 'STAFF_REVIEW', label: 'Staff Review', icon: UserCheck },
  { id: 'ELIGIBLE', label: 'Eligibility', icon: Award },
  { id: 'PAYMENT', label: 'Payment', icon: CreditCard },
  { id: 'READY_PUBLICATION', label: 'Ready for Publication', icon: BookOpen },
  { id: 'PUBLISHED', label: 'Published', icon: Sparkles },
];

export const LeadJourneyStepper: React.FC<JourneyStepperProps> = ({
  currentStatus,
  hasSubmission,
  plagiarismChecked,
  isEligible,
  isPaid,
  isPublished
}) => {
  // Determine completed index based on actual workflow status
  const getStepState = (index: number): 'completed' | 'current' | 'upcoming' => {
    // 0: Interest Form is always completed once lead exists
    // 1: Lead Created is always completed once lead exists
    // 2: Confirmation Email is completed once CONTACTED or beyond
    const statusMap: Record<string, number> = {
      NEW: 1,
      CONTACTED: 2,
      REMINDER_SENT: 3,
      STORY_SUBMITTED: 4,
      UNDER_REVIEW: plagiarismChecked ? 6 : 5,
      ELIGIBLE: 7,
      NOT_ELIGIBLE: 7,
      PAYMENT_PENDING: 8,
      PAID: 8,
      COMPLETED: isPublished ? 10 : (isPaid ? 9 : 8),
    };

    const targetIdx = statusMap[currentStatus?.toUpperCase()] ?? 1;

    if (index < targetIdx) return 'completed';
    if (index === targetIdx) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full bg-white rounded-card p-6 shadow-subtle border border-app-border overflow-x-auto">
      <div className="flex items-center justify-between min-w-[900px] relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-6 right-6 h-1 bg-gray-200 -z-0 rounded-full" />
        
        {STEPS.map((step, idx) => {
          const state = getStepState(idx);
          const IconComponent = step.icon;
          
          let circleBg = 'bg-white border-2 border-gray-300 text-gray-400';
          let textColor = 'text-gray-400 font-normal';

          if (state === 'completed') {
            circleBg = 'bg-gradient-to-br from-primary to-secondary text-white border-none shadow-sm';
            textColor = 'text-primary font-semibold';
          } else if (state === 'current') {
            circleBg = 'bg-primary-soft border-2 border-primary text-primary animate-pulse ring-4 ring-primary-soft';
            textColor = 'text-text-dark font-bold';
          }

          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 group px-2 text-center max-w-[90px]">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${circleBg}`}>
                {state === 'completed' ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <IconComponent className="w-5 h-5" />
                )}
              </div>
              <span className={`text-[11px] mt-2 leading-tight transition-colors ${textColor}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
