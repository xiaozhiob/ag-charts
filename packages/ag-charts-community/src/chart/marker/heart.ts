import { Marker } from './marker';

export class Heart extends Marker {
    static readonly className = 'Heart';

    private static rad(this: void, degree: number) {
        return (degree / 180) * Math.PI;
    }

    override updatePath() {
        const { x, path, size } = this;
        const { rad } = Heart;
        const r = size / 4;
        const y = this.y + r / 2;

        path.clear();
        path.arc(x - r, y - r, r, rad(130), rad(330));
        path.arc(x + r, y - r, r, rad(220), rad(50));
        path.lineTo(x, y + r);
        path.closePath();
    }
}
