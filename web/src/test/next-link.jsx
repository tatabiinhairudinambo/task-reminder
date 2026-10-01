// Minimal next/link double for the react-router shim in tests.
import { createElement } from 'react';

const Link = ({ href, children, ...rest }) => createElement('a', { href, ...rest }, children);

export default Link;
