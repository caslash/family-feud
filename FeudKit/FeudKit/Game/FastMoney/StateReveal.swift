//
//  StateReveal.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/29/23.
//

import Foundation

public class StateReveal: FFFastMoneyState {
    public static var ACTION_REVEALANSWER = 0x12
    
    private final var PLAYER: Int
    
    public override init(fastmoney: FastMoney, player: Int) {
        self.PLAYER = player
        super.init(fastmoney: fastmoney, player: player)
    }
    
    public override func initState(data: Any?) { }
    
    public override func cleanupState() { }
    
    public override func canAdvance(nextState: String) -> Bool {
        if (self.PLAYER == 0) {
            return nextState == FFFastMoneyStateType.P2_ANSWER.description
        }
        return false
    }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case StateReveal.ACTION_REVEALANSWER:
            if (data.count == 3 && data[1] is Int && data[2] is Bool) {
                self.revealAnswer(question: data[1] as! Int, revealed: data[2] as! Bool)
                return true
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        default:
            //TODO: RuntimeException
            fatalError("RuntimeException not implemented")
        }
    }
    
    private func revealAnswer(question: Int, revealed: Bool) { self.fastmoney.setRevealedAnswer(player: self.PLAYER, question: question, revealed: revealed) }
}
