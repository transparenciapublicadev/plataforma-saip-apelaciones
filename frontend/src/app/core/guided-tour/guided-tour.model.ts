export interface TourStep {
  selector: string;
  title: string;
  body: string;
  onEnter?: () => void;
  align?: 'center' | 'start';
}

export type StorageKey = 'saip_tour_done' | 'saip_tour_funcionario' | 'saip_tour_ttaip' | 'saip_tour_admin';
