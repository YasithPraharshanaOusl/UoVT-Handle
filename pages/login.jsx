export default function(req, res) {
    res.redirect(req.method === 'POST' ? 303 : 302, '/account/login');
}
