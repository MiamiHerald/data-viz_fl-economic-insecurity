import $ from 'jquery';
import * as d3 from 'd3';
import * as topojson from 'topojson';
import { TweenLite } from 'gsap';
import numeral from 'numeral';
import * as pym from 'pym.js'
window.$ = $;

class Choropleth {
  constructor(el, dataUrl) {
    this.el = el;
    this.dataUrl = dataUrl;
    this.rateById = d3.map();
    this.aspectRatio = 0.6667;
    this.width = $(this.el).width();
    this.height = Math.ceil(this.aspectRatio * this.width);
    this.mapWidth = this.width;
    this.shapeUrl = `data/florida-counties.json`;
    this.rateById = d3.map();
    this.pymChild = null;
  }

  render() {
    this.svg = d3.select(this.el).append(`svg`)
        .attr(`width`, `100%`)
        .attr(`class`, `choropleth__svg`)
        .append(`g`);

    this.loadData();
    $(window).on(`load`, () => {
      this.pymChild = new pym.Child({ renderCallback: this.resizeChoropleth.bind(this) });
    });
    $(window).on(`resize`, this.resizeChoropleth.bind(this));
  }

  resizeChoropleth() {
    window.requestAnimationFrame(() => {
      const chart = $(this.el).find(`g`);

      this.width = $(this.el).width();
      this.height = Math.ceil(this.aspectRatio * this.width);

      TweenLite.set(chart, { scale: this.width / this.mapWidth });
      d3.select(`.choropleth__svg`).attr(`height`, this.height);

      if (this.pymChild) {
        this.pymChild.sendHeight();
      }
    });
  }

  loadData() {
    d3.queue()
      .defer(d3.json, this.shapeUrl)
      .defer(d3.csv, this.dataUrl, (d) => this.rateById.set(d.Counties, [d[`Percent change in poverty rate by county`], d[`Poverty Rate 2007`], d[`Poverty Rate 2015`]]))
      .await(this.drawMap.bind(this));
  }

  drawMap(error, shapeData) {
    this.draWTooltip();

    // https://github.com/wbkd/d3-extended
    d3.selection.prototype.moveToFront = function() {
      return this.each(function(){
        this.parentNode.appendChild(this);
      });
    };

    d3.selection.prototype.moveToBack = function() {
        return this.each(function() {
            var firstChild = this.parentNode.firstChild;
            if (firstChild) {
                this.parentNode.insertBefore(this, firstChild);
            }
        });
    };

    this.color = d3.scaleThreshold()
      .domain([0, 26, 38, 48, 57])
      .range(['#e6f5d0', '#fde0ef', '#f1b6da', '#de77ae', '#c51b7d', '#8e0152']);

    this.projection = d3.geoEquirectangular()
      .fitSize([this.width, this.height], topojson.feature(shapeData, shapeData.objects[`florida-counties`]));
    this.path = d3.geoPath()
      .projection(this.projection);

    this.svg.selectAll(`path`)
        .data(topojson.feature(shapeData, shapeData.objects[`florida-counties`]).features)
      .enter().append(`path`)
        .attr(`class`, (d) => {
          if (this.rateById.get(d.properties.county)[0] === ``) {
            return `county county--${d.id} county--null`
          } else {
            return `county county--${d.id}`
          }
        })
        .attr(`d`, this.path)
        .style(`fill`, (d) => {
          if (this.rateById.get(d.properties.county)[0] !== ``) {
            return this.color(this.rateById.get(d.properties.county)[0])
          }
        })
        .on(`mouseover`, (d) => {
          d3.select(`.county--${d.id}`)
              .moveToFront()
              .classed(`is-active`, true);

          this.tooltip
            .html(() => {
              if (this.rateById.get(d.properties.county)[0]) {
                return `
                  ${d.properties.county}: ${this.rateById.get(d.properties.county)[0]}%
                  <div class="choropleth__tooltip__quintile--title">2007</div>
                  <div class="choropleth__tooltip__quintile">${this.rateById.get(d.properties.county)[1]}%</div>
                  <div class="choropleth__tooltip__quintile--title">2015</div>
                  <div class="choropleth__tooltip__quintile">${this.rateById.get(d.properties.county)[2]}%</div>
                `
              } else {
                return `${d.properties.county}: Sin datos`
              }
            })
            .classed(`is-active`, true);
        })
        .on(`mousemove`, () => {
          this.tooltip
            .style(`top`, `${d3.event.pageY - 10}px`)
            .style(`left`, `${d3.event.pageX}px`);
        })
        .on(`mouseout`, (d) => {
          d3.select(`.county--${d.id}`)
              .moveToBack()
              .classed(`is-active`, false);

          this.tooltip
            .classed(`is-active`, false);
        });
  }

  draWTooltip() {
    this.tooltip = d3.select(this.el)
      .append(`div`)
      .attr(`class`, `choropleth__tooltip`);
  }
}

const loadChoropleth = () => {
  const $choropleth = $(`.js-choropleth`);

  $choropleth.each((index) => {
    const $this = $choropleth.eq(index);
    const id = $this.attr(`id`);
    const url = $this.data(`url`);

    new Choropleth(`#${id}`, url).render();
  });
}

export { loadChoropleth };
