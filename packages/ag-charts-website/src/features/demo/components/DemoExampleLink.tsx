import classnames from 'classnames';
import type { FunctionComponent } from 'react';
import { getPlainExampleImageUrl, getPageUrl } from '../utils/urlPaths';
import styles from './DemoExampleLink.module.scss';

interface Props {
    label: string;
    exampleName: string;
    className?: string;
}

export const DemoExampleLink: FunctionComponent<Props> = ({ label, exampleName, className }) => {
    const imageUrl = getPlainExampleImageUrl({
        exampleName,
    });

    return (
        <a className={classnames(styles.link, className)} href={getPageUrl(exampleName)}>
            <img src={imageUrl} alt={label} />
            <span className="font-size-responsive font-size-medium">{label}</span>
        </a>
    );
};
