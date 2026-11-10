import { Component, OnInit } from '@angular/core';
import { FlowerService } from '../../../services/flower.service';
import { Flower } from '../../../shared/models/Flower';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  flowers: Flower[] = [];

  constructor(private flowerService: FlowerService) {
    this.flowers = flowerService.getAll();
  }

  ngOnInit(): void {
  }

}