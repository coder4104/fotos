import { useState, useEffect } from "react";

interface CloudSyncToggleProps {
  onToggle: (enabled: boolean) => void;
  initialState?: boolean;
}

export const CloudSyncToggle: React.FC<CloudSyncToggleProps> = ({
  onToggle,
  initialState = false,
}) => {
  const [isEnabled, setIsEnabled] = useState(initialState);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    setIsEnabled(initialState);
  }, [initialState]);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    onToggle(newState);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          transition-all duration-300 ease-in-out transform
          ${isEnabled ? 'bg-gray-900' : 'bg-gray-300'}
          hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-900/20
        `}
        role="switch"
        aria-checked={isEnabled}
        aria-label="Toggle cloud sync"
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full
            bg-white shadow-md transition-all duration-300 ease-in-out
            ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>

      {showTooltip && (
        <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-3 z-20">
          <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-lg">
            {isEnabled ? "Cloud sync enabled" : "Cloud sync disabled"}
          </div>
          <div className="absolute left-full top-1/2 transform -translate-y-1/2">
            <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
};
