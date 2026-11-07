import { geoMercator, geoPath, type GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import React, { useMemo } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-50m.json";

type Props = {
  readonly width: number;
  readonly height: number;
  // [[west, south], [east, north]] in degrees
  readonly bounds?: [[number, number], [number, number]];
  readonly vietnam?: string;
  // When set, Vietnam north of this latitude uses `north`, south of it uses `south`.
  readonly split?: { lat: number; north: string; south: string };
  readonly children?: (project: (lon: number, lat: number) => [number, number]) => React.ReactNode;
};

const SEA = "#4f7cc4";
const LAND = "#e9dfc2";
const COLORS: Record<string, string> = {
  Laos: "#9cc77a",
  Cambodia: "#e6b35a",
  Thailand: "#c9b6d9",
  China: "#d9a07a",
  Myanmar: "#b8d4c8",
  Taiwan: "#d9a07a",
};

const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const countries = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features;

// Paracel and Spratly islands, drawn as Vietnamese territory.
const ISLANDS: [number, number][] = [
  [111.6, 16.5], [112.3, 16.8], [111.9, 16.1], [112.7, 16.3],
  [114.3, 10.4], [114.0, 9.8], [115.2, 10.8], [113.6, 11.4], [114.9, 9.3],
];

export const IndochinaMap: React.FC<Props> = ({
  width,
  height,
  bounds = [[97.5, 7.5], [113.5, 24.2]],
  vietnam = "#d23a2c",
  split,
  children,
}) => {
  const { projection, paths, vn } = useMemo(() => {
    const box: Feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPoint",
        coordinates: [bounds[0], bounds[1]],
      },
    };
    const proj: GeoProjection = geoMercator().fitSize([width, height], box);
    const path = geoPath(proj);
    const near = countries.filter((c) => c.properties.name in COLORS);
    return {
      projection: proj,
      paths: near.map((c) => ({ d: path(c) ?? "", fill: COLORS[c.properties.name] })),
      vn: path(countries.find((c) => c.properties.name === "Vietnam")!) ?? "",
    };
  }, [width, height, bounds]);

  const project = (lon: number, lat: number) => projection([lon, lat]) as [number, number];
  const splitY = split ? project(106, split.lat)[1] : 0;
  const islandColor = split ? split.south : vietnam;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <rect width={width} height={height} fill={SEA} />
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? LAND} stroke="#222" strokeWidth={2.5} strokeLinejoin="round" />
      ))}
      {split ? (
        <>
          <clipPath id="vn-north">
            <rect x={0} y={0} width={width} height={splitY} />
          </clipPath>
          <clipPath id="vn-south">
            <rect x={0} y={splitY} width={width} height={height - splitY} />
          </clipPath>
          <path d={vn} fill={split.north} clipPath="url(#vn-north)" />
          <path d={vn} fill={split.south} clipPath="url(#vn-south)" />
          <path d={vn} fill="none" stroke="#222" strokeWidth={3} strokeLinejoin="round" />
        </>
      ) : (
        <path d={vn} fill={vietnam} stroke="#222" strokeWidth={3} strokeLinejoin="round" />
      )}
      {ISLANDS.map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return <circle key={i} cx={x} cy={y} r={4} fill={islandColor} stroke="#222" strokeWidth={1.5} />;
      })}
      {children ? children(project) : null}
    </svg>
  );
};
