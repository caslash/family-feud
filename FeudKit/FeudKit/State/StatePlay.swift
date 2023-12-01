//
//  StatePlay.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StatePlay: FFState {
    public static var ACTION_EXECUTEPLAYACTION: Int = 0x00;
    
    public static var CHANGESTATE_FACEOFF: Int = 0x10;
    
    public static var CHANGESTATE_FAMILYPLAY: Int = 0x11;
    
    public static var CHANGESTATE_FAMILYSTEAL: Int = 0x12;
    
    public static var CHANGESTATE_ALLOCATEPOINTS: Int = 0x13;
    
    public static var CHANGESTATE_REVEALANSWERS: Int = 0x14;
    
    public static var CHANGESTATE_SELECTQUESTION: Int = 0x15;
    
    private var game: FamilyFeudGame
    
    private var stateMachine: FFPlayStateMachine?
    
    internal init(game: FamilyFeudGame) {
        self.game = game
        super.init(type: FFStateType.PLAY)
    }
    
    public override func initState(data: Any) {
        self.stateMachine = FFPlayStateMachine(questions: self.game.getQuestionSet(), families: self.game.getFamilyCollection())
        self.stateMachine!.initialize()
    }
    
    public override func cleanupState() { }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case StatePlay.ACTION_EXECUTEPLAYACTION:
            if (data[0] is Int) {
                return self.stateMachine!.getCurrentState()!.executeAction(action: data[0] as! Int, data: data)
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        case StatePlay.CHANGESTATE_FACEOFF:
            return self.stateMachine!.changeState(name: FFPlayStateType.FACE_OFF.description)
        case StatePlay.CHANGESTATE_FAMILYPLAY:
            return self.stateMachine!.changeState(name: FFPlayStateType.FAMILY_PLAY.description)
        case StatePlay.CHANGESTATE_FAMILYSTEAL:
            return self.stateMachine!.changeState(name: FFPlayStateType.FAMILY_STEAL.description)
        case StatePlay.CHANGESTATE_ALLOCATEPOINTS:
            return self.stateMachine!.changeState(name: FFPlayStateType.ALLOCATE_POINTS.description)
        case StatePlay.CHANGESTATE_REVEALANSWERS:
            return self.stateMachine!.changeState(name: FFPlayStateType.REVEAL_ANSWERS.description)
        case StatePlay.CHANGESTATE_SELECTQUESTION:
            return self.stateMachine!.changeState(name: FFPlayStateType.SELECT_QUESTION.description)
        default:
            return false
        }
    }
    
    public func getPlayState() -> FFPlayState? {
        if (self.stateMachine != nil) { return self.stateMachine!.getCurrentState() }
        return nil
    }
}
