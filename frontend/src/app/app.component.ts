import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SeriesService } from './services/series.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  series: any[] = [];
  searchTerm: string = '';

  constructor(private seriesService: SeriesService) {}

  ngOnInit(): void {
    this.cargarTendencias();
  }

  cargarTendencias() {
    this.seriesService.getTrendingSeries().subscribe(data => this.series = data);
  }

  buscar(event: any) {
    const valor = event.target.value;
    if (valor.length > 2) {
      this.seriesService.searchSeries(valor).subscribe(data => this.series = data);
    } else if (valor.length === 0) {
      this.cargarTendencias();
    }
  }
}