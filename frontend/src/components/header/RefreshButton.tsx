import { RefreshIcon } from '../icons/Icons';

interface Props {
  busy?: boolean;
  onClick: () => void;
}

export function RefreshButton({ busy, onClick }: Props) {
  return (
    <button
      type="button"
      className={`btn-icon ${busy ? 'spin' : ''}`}
      onClick={onClick}
      aria-label="Refresh"
      title="Refresh now"
    >
      <RefreshIcon size={16} />
    </button>
  );
}
