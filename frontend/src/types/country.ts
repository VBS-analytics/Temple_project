import { CountryDialCode } from '../data/countryDialCodes';

export type CountryOption = {
  iso: CountryDialCode['iso2'];
  code: CountryDialCode['dialCode'];
  label: CountryDialCode['name'];
};
