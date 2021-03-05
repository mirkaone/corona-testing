import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from 'next-auth/client';
import prisma from "../../lib/prisma";

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.status(405).json({ result: 'error' });
        return;
    }

    const session = await getSession({ req });

    if (!session) {
        res.status(401).json({ result: 'error' });
        return;
    }

    const code = req.body?.code?.toString() || '';
    const date = new Date(req.body?.date);

    if (isNaN(date.getTime())) {
        res.status(400).json({ result: 'error', message: 'Invalid date' });
        return;
    }

    const slot = await prisma.slot.findUnique({
        where: {
            date
        }
    });

    if (!slot) {
        res.status(400).json({ result: 'error', message: 'Slot does not exist' });
        return;
    }

    res.status(200).json({
        result: code.toLowerCase() === slot.code.toLowerCase() ? 'valid' : 'invalid',
    });
}