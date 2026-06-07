import { BrandCubeIcon } from '../icons/Icons';

export function BrandTitle() {
  return (
    <div className="header__brand-row">
      <BrandCubeIcon className="header__brand-icon" size={26} />
      <h1 className="header__title">
        <span className="header__title-solid">Unified</span>
        <span className="header__title-grad">Ops</span>
      </h1>
    </div>
  );
}
