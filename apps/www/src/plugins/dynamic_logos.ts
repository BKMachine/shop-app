import DoosanLogo from '@/assets/machine_logos/doosan.png';
import FanucLogo from '@/assets/machine_logos/fanuc.png';
import HaasLogo from '@/assets/machine_logos/haas.png';
import HanwhaLogo from '@/assets/machine_logos/hanwha.png';
import MazakLogo from '@/assets/machine_logos/mazak.png';
import MitsubishiLogo from '@/assets/machine_logos/mitsubishi.png';
import MoriLogo from '@/assets/machine_logos/mori.png';
import Arduino from '@/assets/machine_sources/arduino.png';
import Focas from '@/assets/machine_sources/focas.png';
import MTConnect from '@/assets/machine_sources/mtconnect.png';
import Lathe from '@/assets/machine_types/lathe.png';
import Mill from '@/assets/machine_types/mill.png';
import Swiss from '@/assets/machine_types/swiss.png';

const brand: { [key: string]: string } = {
  doosan: DoosanLogo,
  fanuc: FanucLogo,
  haas: HaasLogo,
  hanwha: HanwhaLogo,
  mazak: MazakLogo,
  mitsubishi: MitsubishiLogo,
  mori: MoriLogo,
};

const type: { [key: string]: string } = {
  mill: Mill,
  lathe: Lathe,
  swiss: Swiss,
};

const source: { [key: string]: string } = {
  focas: Focas,
  arduino: Arduino,
  mtconnect: MTConnect,
};

export default {
  brand,
  type,
  source,
};
